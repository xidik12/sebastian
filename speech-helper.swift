import Foundation
import Speech
import AVFoundation

// Speech recognition helper using RunLoop instead of semaphore
// The main run loop must be running for SFSpeechRecognizer callbacks

let duration = CommandLine.arguments.count > 1
    ? Double(CommandLine.arguments[1]) ?? 8.0
    : 8.0

var finalText = ""
var done = false

func finish() {
    if done { return }
    done = true
    if !finalText.isEmpty {
        print(finalText)
        fflush(stdout)
    }
    exit(0)
}

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        fputs("Not authorized\n", stderr)
        exit(1)
    }

    DispatchQueue.main.async {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.isAvailable else {
            fputs("Recognizer not available\n", stderr)
            exit(1)
        }

        let audioEngine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            fputs("Audio error: \(error)\n", stderr)
            exit(1)
        }

        recognizer.recognitionTask(with: request) { result, error in
            if let result = result {
                finalText = result.bestTranscription.formattedString
                if result.isFinal {
                    audioEngine.stop()
                    inputNode.removeTap(onBus: 0)
                    finish()
                }
            }
            if let error = error {
                fputs("Rec error: \(error.localizedDescription)\n", stderr)
                audioEngine.stop()
                inputNode.removeTap(onBus: 0)
                finish()
            }
        }

        // Timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            request.endAudio()
            audioEngine.stop()
            inputNode.removeTap(onBus: 0)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                finish()
            }
        }
    }
}

// Keep the main run loop alive — this is critical for SFSpeechRecognizer
RunLoop.main.run()

import Foundation
import Speech

// File-based speech recognition — transcribes a WAV/audio file using SFSpeechRecognizer
// Unlike the mic-based helper, this doesn't need microphone permission

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: speech-file-helper <audio-file-path>\n", stderr)
    exit(1)
}

let filePath = CommandLine.arguments[1]
let fileURL = URL(fileURLWithPath: filePath)

guard FileManager.default.fileExists(atPath: filePath) else {
    fputs("File not found: \(filePath)\n", stderr)
    exit(1)
}

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        fputs("Speech recognition not authorized\n", stderr)
        exit(1)
    }

    DispatchQueue.main.async {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.isAvailable else {
            fputs("Recognizer not available\n", stderr)
            exit(1)
        }

        let request = SFSpeechURLRecognitionRequest(url: fileURL)
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        recognizer.recognitionTask(with: request) { result, error in
            if let result = result {
                if result.isFinal {
                    let text = result.bestTranscription.formattedString
                    if !text.isEmpty {
                        print(text)
                        fflush(stdout)
                    }
                    exit(0)
                }
            }
            if let error = error {
                fputs("Recognition error: \(error.localizedDescription)\n", stderr)
                exit(1)
            }
        }

        // Timeout after 30 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            fputs("Transcription timeout\n", stderr)
            exit(1)
        }
    }
}

RunLoop.main.run()

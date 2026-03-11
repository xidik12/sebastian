import Foundation
import Speech
import AVFoundation

// Continuous wake word listener for Sebastian
// Listens for "sebastian" in speech, then captures the following command
// Protocol:
//   stdout: "WAKE\n" when wake word detected
//   stdout: "PROMPT:<text>\n" with the captured command
//   stdin:  "STOP\n" to terminate

let semaphore = DispatchSemaphore(value: 0)
var shouldRun = true

// Listen for STOP on stdin
DispatchQueue.global(qos: .background).async {
    while let line = readLine() {
        if line.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "STOP" {
            shouldRun = false
            semaphore.signal()
            break
        }
    }
}

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        fputs("Speech recognition not authorized\n", stderr)
        exit(1)
    }

    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
          recognizer.isAvailable else {
        fputs("Speech recognizer not available\n", stderr)
        exit(1)
    }

    func startListening() {
        guard shouldRun else { semaphore.signal(); return }

        let audioEngine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            fputs("Audio engine failed: \(error)\n", stderr)
            // Retry after delay
            DispatchQueue.global().asyncAfter(deadline: .now() + 3) { startListening() }
            return
        }

        var wakeDetected = false
        var wakeTime: Date?
        var capturedText = ""
        var lastPartialTime = Date()

        recognizer.recognitionTask(with: request) { result, error in
            guard shouldRun else {
                audioEngine.stop()
                inputNode.removeTap(onBus: 0)
                return
            }

            if let result = result {
                let text = result.bestTranscription.formattedString.lowercased()
                lastPartialTime = Date()

                if !wakeDetected {
                    // Check for wake word
                    if text.contains("sebastian") || text.contains("sabastian") || text.contains("sevastian") {
                        wakeDetected = true
                        wakeTime = Date()
                        print("WAKE")
                        fflush(stdout)

                        // Remove everything up to and including the wake word
                        let patterns = ["sebastian", "sabastian", "sevastian"]
                        var remaining = text
                        for pattern in patterns {
                            if let range = remaining.range(of: pattern) {
                                remaining = String(remaining[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                                break
                            }
                        }
                        capturedText = remaining
                    }
                } else {
                    // Capturing command after wake word
                    let patterns = ["sebastian", "sabastian", "sevastian"]
                    var remaining = text
                    for pattern in patterns {
                        if let range = remaining.range(of: pattern, options: .backwards) {
                            remaining = String(remaining[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                            break
                        }
                    }
                    capturedText = remaining
                }

                if result.isFinal {
                    audioEngine.stop()
                    inputNode.removeTap(onBus: 0)

                    if wakeDetected && !capturedText.isEmpty {
                        print("PROMPT:\(capturedText)")
                        fflush(stdout)
                    }

                    // Restart listening
                    DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { startListening() }
                }
            }

            if error != nil {
                audioEngine.stop()
                inputNode.removeTap(onBus: 0)

                if wakeDetected && !capturedText.isEmpty {
                    print("PROMPT:\(capturedText)")
                    fflush(stdout)
                }

                // Restart listening
                DispatchQueue.global().asyncAfter(deadline: .now() + 1) { startListening() }
            }
        }

        // Restart recognition task every ~50s (Apple's 1-min limit)
        DispatchQueue.global().asyncAfter(deadline: .now() + 50) {
            guard shouldRun else { return }

            if wakeDetected && !capturedText.isEmpty {
                print("PROMPT:\(capturedText)")
                fflush(stdout)
            }

            request.endAudio()
            audioEngine.stop()
            inputNode.removeTap(onBus: 0)

            DispatchQueue.global().asyncAfter(deadline: .now() + 1) { startListening() }
        }

        // If wake word detected, wait 8s then emit prompt and restart
        if wakeDetected {
            DispatchQueue.global().asyncAfter(deadline: .now() + 8) {
                if wakeDetected && !capturedText.isEmpty {
                    print("PROMPT:\(capturedText)")
                    fflush(stdout)
                }

                request.endAudio()
                audioEngine.stop()
                inputNode.removeTap(onBus: 0)

                DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { startListening() }
            }
        }
    }

    startListening()
}

semaphore.wait()

# Open source cho từng thành phần

Tóm tắt khảo sát ngày 31/10/2026 (license, số star, mức độ bảo trì do một subagent đọc trên GitHub/Hugging Face). Bảng đầy đủ khoảng 80 dự án nằm trong tài liệu sản phẩm (Claude Docs, tab "Open source"). **Phải rà soát license lại trước khi đưa vào sản phẩm.**

## Stack đề xuất cho MVP

| Khối                 | Dự án                                                                                                                                                     | License                  | Module dùng                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------- |
| App shell            | Fork hoặc tham khảo [anarlog](https://github.com/fastrepl/anarlog) (trước là Hyprnote, Tauri), [Meetily](https://github.com/Zackriya-Solutions/meetily)   | MIT                      | apps/desktop                        |
| Thu âm               | Mẫu [AudioCap](https://github.com/insidegui/AudioCap) (Process Tap), ScreenCaptureKit, [cpal](https://github.com/RustAudio/cpal)                          | BSD-2 / Apache-2.0       | desktop/audio-capture               |
| VAD                  | [Silero VAD](https://github.com/snakers4/silero-vad)                                                                                                      | MIT                      | desktop/audio-capture               |
| STT on-device        | [FluidAudio](https://github.com/FluidInference/FluidAudio) + [Parakeet-TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)                   | Apache-2.0 / CC-BY-4.0   | desktop/local-stt                   |
| STT dự phòng         | [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [WhisperKit](https://github.com/argmaxinc/argmax-oss-swift)                                       | MIT                      | desktop/local-stt                   |
| Dịch local           | [TranslateGemma 4B](https://huggingface.co/google/translategemma-4b-it), [Qwen3-4B-Instruct](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)          | Gemma Terms / Apache-2.0 | packages/ai-gateway                 |
| Debrief              | [WhisperX](https://github.com/m-bain/whisperX), [pyannote](https://github.com/pyannote/pyannote-audio)                                                    | BSD-2 / MIT              | workers/debrief-job (giai đoạn sau) |
| Ôn tập               | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)                                                                                              | MIT                      | packages/learner-model              |
| TTS                  | [Kokoro](https://github.com/hexgrad/kokoro) (EN), [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (VI)                                               | Apache-2.0               | workers/tts-cache                   |
| Memory (Đợt 4)       | [mem0](https://github.com/mem0ai/mem0), [Graphiti](https://github.com/getzep/graphiti), [pyBKT](https://github.com/CAHLR/pyBKT)                           | Apache-2.0 / MIT         | api/learner                         |
| Voice tutor (Đợt 4)  | [Pipecat](https://github.com/pipecat-ai/pipecat) + smart-turn                                                                                             | BSD-2                    | —                                   |
| Chấm phát âm (Đợt 3) | wav2vec2-espeak, [ctc-forced-aligner](https://github.com/MahmoudAshraf97/ctc-forced-aligner), [OpenPronounce](https://github.com/Halleck45/OpenPronounce) | Apache-2.0 / BSD-2 / MIT | —                                   |

## Phải tự xây

Lớp sư phạm trên cuộc họp thật · Learner Model đa kênh · chấm phát âm cho người Việt nói tiếng Anh · caption EN→VI đồng thời độ trễ thấp · UX overlay + Assist Dial · virtual mic.

## Không dùng (rủi ro license)

| Lý do               | Dự án                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cấm thương mại (NC) | NLLB-200, SeamlessM4T/Streaming, MMS-TTS, XTTS-v2/viXTTS, F5-TTS weights, Moonshine bản VI/JA/KO, ChunkFormer-CTC-VI |
| Điều khoản riêng    | TEN Framework/VAD (cấm cạnh tranh với Agora), screenpipe (commercial), Attendee (Elastic 2.0)                        |
| AGPL                | Anki, VinAI Translate, LibreTranslate, LibreLingo                                                                    |
| GPL (không bundle)  | BlackHole, Piper (piper1-gpl), LiveCaptions, LocalVocal                                                              |
| Không có license    | CTC-based-GOP, ViStreamASR, kaldi-gop                                                                                |

WhisperLiveKit mặc định dùng NLLB để dịch. Nếu fork thì phải thay phần dịch.

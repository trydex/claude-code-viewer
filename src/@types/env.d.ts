declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        DEV_BE_PORT?: string;
        PORT?: string;
      }
    }
  }
}

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

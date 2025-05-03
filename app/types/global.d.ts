interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  webkitSpeechRecognition: typeof SpeechRecognition;
  SpeechRecognition: typeof SpeechRecognition;
}

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

// Declare Link in a namespace to prevent conflicts
declare namespace MDXNamespace {
  interface Link {
    // Add properties as needed
  }
}

declare namespace ReactRouterNamespace {
  interface Link {
    // Add properties as needed
  }
}

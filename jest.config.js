module.exports = {
  "collectCoverageFrom": [
    "src/**/*.{js,ts}"
  ],
  "testMatch": [
    "<rootDir>/src/**/__tests__/**/*.ts",
    "<rootDir>/src/**/?(*.)spec.ts"
  ],
  "testEnvironment": "node",
  "testEnvironmentOptions": {
    "url": "http://localhost"
  },
  "transform": {
    "^.+\\.ts$": "ts-jest",
  },
  "transformIgnorePatterns": [
    "[/\\\\]node_modules[/\\\\].+\\.(js|ts)$"
  ],
  "coveragePathIgnorePatterns": [
    "<rootDir>/dist/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/index.ts"
  ],
  "moduleFileExtensions": [
    "ts",
    "js",
    "json",
    "node"
  ],
  "coverageReporters": [
    "text",
    "text-summary",
    "html"
  ]
};

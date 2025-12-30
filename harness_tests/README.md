# WebCodecs Harness

This is a set of tests to be able to assess the https://github.com/vjeux/webcodecs-nodejs-10k-challenge submissions. This is originally based on participants test suites but hoping to add mode to cover a wider range of the specs.

To run it,

```
brew install ffmpeg pkg-config
npm install
```

Open `src/polyfill.js` and uncomment the implementation you want to test

```
npm test
```

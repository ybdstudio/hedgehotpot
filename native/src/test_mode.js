/* Local QA configuration. This file exists only on native/tiktok-autoplay-test. */
(function (root) {
  const CST = root.CST;
  CST.NATIVE_TEST = {
    speeds: [1, 1.5, 2, 4],
    text: {
      section: 'Autoplay test', autoplay: 'Autoplay', on: 'On', off: 'Off',
      speed: 'Simulation speed', selected: 'Selected', select: 'Select'
    }
  };
  // Test runs never overwrite the manual build's restaurant save.
  CST.CONFIG.SAVE_KEY += '_native_autoplay_test';
})(typeof window !== 'undefined' ? window : globalThis);

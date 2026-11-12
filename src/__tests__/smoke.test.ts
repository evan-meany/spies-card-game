import config from '../../app.json';

describe('app config', () => {
  it('names the app Spies', () => {
    expect(config.expo.name).toBe('Spies');
    expect(config.expo.slug).toBe('spies');
  });
});

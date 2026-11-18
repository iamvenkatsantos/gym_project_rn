const { addFactory, addImports } = require('../with-http-concurrency');

const MAIN = `package com.corefit.gym

import android.app.Application

class MainApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
`;

describe('with-http-concurrency', () => {
  it('sets the client factory right after super.onCreate()', () => {
    const out = addFactory(addImports(MAIN));
    expect(out).toContain('import okhttp3.Dispatcher');
    expect(out).toContain('maxRequestsPerHost = 16');
    expect(out.indexOf('super.onCreate()')).toBeLessThan(out.indexOf('setOkHttpClientFactory'));
    expect(out.indexOf('setOkHttpClientFactory')).toBeLessThan(out.indexOf('loadReactNative'));
  });

  it('changes nothing when run twice', () => {
    const once = addFactory(addImports(MAIN));
    expect(addFactory(addImports(once))).toBe(once);
  });

  it('refuses a MainApplication without super.onCreate()', () => {
    expect(() => addFactory('class MainApplication')).toThrow(/super.onCreate/);
  });
});

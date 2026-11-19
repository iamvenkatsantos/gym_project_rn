const { addRequestLimit } = require('../with-okhttp-request-limit');

const MAIN_APPLICATION = `package com.corefit.gym

import android.app.Application
import android.content.res.Configuration

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
`;

describe('with-okhttp-request-limit', () => {
  it('sets the request limit right after super.onCreate()', () => {
    const out = addRequestLimit(MAIN_APPLICATION);
    expect(out).toContain('import com.facebook.react.modules.network.OkHttpClientFactory');
    expect(out).toContain('import com.facebook.react.modules.network.OkHttpClientProvider');
    expect(out).toContain('maxRequestsPerHost = 16');
    expect(out.indexOf('super.onCreate()')).toBeLessThan(out.indexOf('setOkHttpClientFactory'));
    expect(out.indexOf('setOkHttpClientFactory')).toBeLessThan(out.indexOf('loadReactNative'));
  });

  it('changes nothing the second time', () => {
    const once = addRequestLimit(MAIN_APPLICATION);
    expect(addRequestLimit(once)).toBe(once);
  });

  it('fails loudly when onCreate is missing', () => {
    expect(() => addRequestLimit('class A')).toThrow('onCreate');
  });
});

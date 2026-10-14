import { applyTheme, themeColors } from './theme';

describe('Theme colour', () => {
  let light: HTMLMetaElement;
  let dark: HTMLMetaElement;

  // The tags `index.html` puts in the head, one per device scheme.
  beforeEach(() => {
    light = Object.assign(document.createElement('meta'), { name: 'theme-color', media: '(prefers-color-scheme: light)', content: themeColors.light });
    dark = Object.assign(document.createElement('meta'), { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: themeColors.dark });
    document.head.append(light, dark);
  });

  afterEach(() => {
    light.remove();
    dark.remove();
    applyTheme('system');
  });

  it('matches the chosen scheme whatever the device prefers, and each tag its own scheme again on Match device', () => {
    applyTheme('dark');
    expect([light.content, dark.content]).toEqual([themeColors.dark, themeColors.dark]);

    applyTheme('light');
    expect([light.content, dark.content]).toEqual([themeColors.light, themeColors.light]);

    applyTheme('system');
    expect([light.content, dark.content]).toEqual([themeColors.light, themeColors.dark]);
  });
});

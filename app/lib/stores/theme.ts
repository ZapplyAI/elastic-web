import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark' | 'light';

export const kTheme = 'elasticApp_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore());

function initStore() {
  // Check if we're in a browser environment where document and localStorage are available
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined' && !import.meta.env.SSR) {
    try {
      const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
      const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

      return persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
    } catch (error) {
      console.error('Error accessing browser APIs in theme store:', error);
      return DEFAULT_THEME;
    }
  }

  return DEFAULT_THEME;
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Update the theme store
  themeStore.set(newTheme);

  // Only execute browser-specific code if we're in a browser environment
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      // Update localStorage
      localStorage.setItem(kTheme, newTheme);

      // Update the HTML attribute
      document.querySelector('html')?.setAttribute('data-theme', newTheme);

      // Update user profile if it exists
      const userProfile = localStorage.getItem('elasticApp_user_profile');

      if (userProfile) {
        const profile = JSON.parse(userProfile);
        profile.theme = newTheme;
        localStorage.setItem('elasticApp_user_profile', JSON.stringify(profile));
      }
    } catch (error) {
      console.error('Error updating theme in browser:', error);
    }
  }

  logStore.logSystem(`Theme changed to ${newTheme} mode`);
}

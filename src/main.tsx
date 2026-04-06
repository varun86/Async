import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { APP_UI_STYLE, readPrefersDark, readStoredColorMode, resolveEffectiveScheme } from './colorMode';
import { I18nProvider } from './i18n';
import './index.css';
import './styles/tokens.css';
import './styles/theme-dark.css';
import './styles/theme-light.css';
import './styles/motion.css';
import './styles/mac-codex.css';

const initialScheme = resolveEffectiveScheme(readStoredColorMode(), readPrefersDark());
document.documentElement.setAttribute('data-ui-style', APP_UI_STYLE);
document.documentElement.setAttribute('data-color-scheme', initialScheme);
const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
const platformRaw = userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
const platform = /win/i.test(platformRaw) ? 'win32' : /mac/i.test(platformRaw) ? 'darwin' : 'linux';
document.documentElement.setAttribute('data-platform', platform);

function readAppSurfaceFromUrl(): 'agent' | 'editor' | undefined {
	try {
		const s = new URLSearchParams(window.location.search).get('surface');
		if (s === 'agent' || s === 'editor') {
			return s;
		}
	} catch {
		/* ignore */
	}
	return undefined;
}

const appSurface = readAppSurfaceFromUrl();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<I18nProvider>
			<App appSurface={appSurface} />
		</I18nProvider>
	</StrictMode>
);

const bootSplash = document.getElementById('boot-splash');
if (bootSplash) {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			bootSplash.classList.add('is-hidden');
			window.setTimeout(() => bootSplash.remove(), 320);
		});
	});
}

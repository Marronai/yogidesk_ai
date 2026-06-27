import * as WebBrowser from 'expo-web-browser';
import { appConfig } from '../config';

const openSecureUrl = async (url: string): Promise<void> => {
  if (new URL(url).protocol !== 'https:') throw new Error('Only secure HTTPS links are allowed.');
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    controlsColor: '#ea580c',
    toolbarColor: '#ffffff',
  });
};

export const openSignupPortal = () => openSecureUrl(appConfig.signupUrl);
export const openRechargePortal = () => openSecureUrl(appConfig.rechargeUrl);

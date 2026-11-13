import { CONSENT_MAX_AGE_MS, CONSENT_STORAGE_KEY } from './consent'

/**
 * Script en línea que se ejecuta antes que GTM: Consent Mode v2 con todo denegado y, si el usuario
 * aceptó hace menos de 12 meses, la concesión de analítica antes de la primera página vista.
 * ES5 autocontenido; misma regla de validación que `readConsent`.
 */
export function consentDefaultsScript(): string {
  return `(function(){
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
try{
var raw=window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});
if(!raw)return;
var c=JSON.parse(raw);
if(c&&c.choice==='granted'&&typeof c.at==='number'&&isFinite(c.at)&&Date.now()-c.at<=${CONSENT_MAX_AGE_MS}){
gtag('consent','update',{analytics_storage:'granted'});
}
}catch(e){}
})();`
}

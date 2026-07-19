export const AUTH_EVENT = 'auth-change';

export function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

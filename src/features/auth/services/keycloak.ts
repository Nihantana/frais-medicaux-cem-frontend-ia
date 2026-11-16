import Keycloak from "keycloak-js";
import { setApiToken } from "../../../services/api";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

let initialized = false;
let initializationPromise: Promise<void> | null = null;

export function initializeKeycloak(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initializationPromise !== null) return initializationPromise;

  initializationPromise = keycloak
    .init({
      onLoad: "login-required",
      pkceMethod: "S256",
      checkLoginIframe: false,
    })
    .then((authenticated) => {
      if (!authenticated || keycloak.token === undefined) {
        throw new Error("La session Keycloak n'a pas pu être établie.");
      }

      setApiToken(keycloak.token);
      keycloak.onTokenExpired = async () => {
        await refreshKeycloakToken();
      };
      initialized = true;
    })
    .catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });

  return initializationPromise;
}

export async function refreshKeycloakToken(): Promise<void> {
  if (!initialized && keycloak.token === undefined) {
    throw new Error("Keycloak n'est pas initialisé.");
  }
  await keycloak.updateToken(30);
  if (keycloak.token === undefined) {
    throw new Error("Le token Keycloak est indisponible.");
  }
  setApiToken(keycloak.token);
}

/** Returns a current token for connections that cannot reuse Axios headers (WebSocket). */
export async function getKeycloakAccessToken(): Promise<string> {
  await initializeKeycloak();
  await refreshKeycloakToken();
  if (keycloak.token === undefined) {
    throw new Error("Le jeton Keycloak est indisponible.");
  }
  return keycloak.token;
}

export async function logoutKeycloak(): Promise<void> {
  setApiToken(null);
  initialized = false;
  initializationPromise = null;
  await keycloak.logout({ redirectUri: window.location.origin });
}

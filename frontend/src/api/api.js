const API_BASE = "http://127.0.0.1:8000/api/v1";

/* Get stored token */
const getToken = () => {
  return localStorage.getItem("access_token");
};

/* Generic API request */
export const apiRequest = async (endpoint, options = {}) => {

  const token = getToken();

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, config);

  const data = await res.json();

  if (!res.ok) {
    throw data;
  }

  return data;
};

/* LOGIN */
export const loginUser = async (email, password) => {

  const data = await apiRequest("/users/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem("access_token", data.data.access_token);
  localStorage.setItem("refresh_token", data.data.refresh_token);

  return data;
};

/* REGISTER */
export const registerUser = async (payload) => {

  return apiRequest("/users/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

};

/* GET CURRENT USER */
export const getCurrentUser = async () => {

  return apiRequest("/users/me/");

};

/* GET BUSINESS */
export const getMyBusiness = async () => {

  return apiRequest("/business/my/");

};

/* LOGOUT */
export const logoutUser = () => {

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

};
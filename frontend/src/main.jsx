import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/index.css";
import { installAuthFetchInterceptor } from "./api/authFetch";

installAuthFetchInterceptor();

createRoot(document.getElementById("root")).render(
  <App />
);

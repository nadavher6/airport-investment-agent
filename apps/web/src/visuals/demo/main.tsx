import "../../styles/tokens.css";
import "../../styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoPage } from "./DemoPage";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") === "light" ? "light" : "dark";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><DemoPage /></StrictMode>);

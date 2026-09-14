import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

[
	"videoSearchQuery_page",
	"videoResults_page",
	"videoTaskStatuses_page",
	"videoSearchQuery",
	"videoResults",
	"videoTaskStatuses",
].forEach((key) => localStorage.removeItem(key));

createRoot(document.getElementById("root")!).render(<App />);

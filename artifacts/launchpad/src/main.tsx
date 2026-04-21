import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { prefetchAllTokenMetadata } from "@/lib/token-metadata";

void prefetchAllTokenMetadata();

createRoot(document.getElementById("root")!).render(<App />);

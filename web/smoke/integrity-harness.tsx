import React from "react";
import ReactDOM from "react-dom/client";
import IntegrityBadge from "../src/components/IntegrityBadge.tsx";
import "../src/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <main className="app-main">
    <IntegrityBadge />
  </main>
);

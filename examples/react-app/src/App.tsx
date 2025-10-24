import React, { useEffect, useState } from "react";
import { Counter } from "./components/Counter";
import { FeatureShowcase } from "./components/FeatureShowcase";
import ModernFeatures from "./components/ModernFeatures";
import { TodoList } from "./components/TodoList";
import "./App.css";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "counter" | "todos" | "features" | "modern"
  >("modern");

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚀 React App Example</h1>
        <p>
          Built with <strong>Dler</strong> - A modern build tool for
          TypeScript/JavaScript projects
        </p>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === "modern" ? "active" : ""}
          onClick={() => setActiveTab("modern")}
        >
          🚀 Modern Features
        </button>
        <button
          className={activeTab === "features" ? "active" : ""}
          onClick={() => setActiveTab("features")}
        >
          ✨ Features
        </button>
        <button
          className={activeTab === "counter" ? "active" : ""}
          onClick={() => setActiveTab("counter")}
        >
          🔢 Counter
        </button>
        <button
          className={activeTab === "todos" ? "active" : ""}
          onClick={() => setActiveTab("todos")}
        >
          📝 Todos
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "modern" && <ModernFeatures />}
        {activeTab === "features" && <FeatureShowcase />}
        {activeTab === "counter" && <Counter />}
        {activeTab === "todos" && <TodoList />}
      </main>

      <footer className="app-footer">
        <p>
          This app demonstrates Dler's enhanced frontend build capabilities
          including:
          <br />
          HTML entry points, CSS processing, asset optimization, dev server with
          HMR,
          <br />
          React Fast Refresh, CSS Modules, SVG as React components, Web Workers,
          <br />
          bundle analysis, performance monitoring, and modern asset optimization
        </p>
      </footer>
    </div>
  );
};

export default App;

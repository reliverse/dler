import React, { useEffect, useState } from "react";

interface Feature {
  title: string;
  description: string;
  icon: string;
  status: "working" | "demo" | "coming-soon";
}

const features: Feature[] = [
  {
    title: "HTML Entry Points",
    description:
      "Build HTML files as entry points with automatic script injection",
    icon: "📄",
    status: "working",
  },
  {
    title: "CSS Processing",
    description: "Built-in CSS processing with chunking and optimization",
    icon: "🎨",
    status: "working",
  },
  {
    title: "Asset Optimization",
    description: "Automatic handling of images, fonts, and static assets",
    icon: "🖼️",
    status: "working",
  },
  {
    title: "Dev Server with HMR",
    description: "Hot Module Replacement for instant development feedback",
    icon: "⚡",
    status: "working",
  },
  {
    title: "TypeScript Support",
    description: "Full TypeScript support with type checking and compilation",
    icon: "🔷",
    status: "working",
  },
  {
    title: "Code Splitting",
    description: "Automatic code splitting for optimal bundle sizes",
    icon: "📦",
    status: "working",
  },
  {
    title: "Framework Detection",
    description: "Auto-detection of React frameworks",
    icon: "🔍",
    status: "working",
  },
  {
    title: "Production Optimization",
    description: "Minification, tree-shaking, and production-ready builds",
    icon: "🚀",
    status: "working",
  },
];

export const FeatureShowcase: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: Feature["status"]) => {
    switch (status) {
      case "working":
        return "#10b981";
      case "demo":
        return "#f59e0b";
      case "coming-soon":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status: Feature["status"]) => {
    switch (status) {
      case "working":
        return "✅ Working";
      case "demo":
        return "🔄 Demo";
      case "coming-soon":
        return "⏳ Coming Soon";
      default:
        return "❓ Unknown";
    }
  };

  return (
    <div className="fade-in">
      <div className="card mb-6">
        <div className="card-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            {/* <img 
               src="/logo.svg" 
               alt="Dler Logo" 
               style={{ height: '40px', marginRight: '1rem' }}
             /> */}
            <div>
              <h2 className="card-title">✨ Dler Frontend Features</h2>
              <p className="card-description">
                This React app demonstrates the powerful frontend build
                capabilities of Dler
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {features.map((feature, index) => (
            <div
              className="card"
              key={feature.title}
              style={{
                animationDelay: `${index * 0.1}s`,
                borderLeft: `4px solid ${getStatusColor(feature.status)}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.5rem", marginRight: "0.5rem" }}>
                  {feature.icon}
                </span>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#333",
                  }}
                >
                  {feature.title}
                </h3>
              </div>
              <p
                style={{
                  color: "#666",
                  fontSize: "0.9rem",
                  marginBottom: "0.5rem",
                }}
              >
                {feature.description}
              </p>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: "500",
                  color: getStatusColor(feature.status),
                }}
              >
                {getStatusText(feature.status)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🕒 Live Demo</h2>
          <p className="card-description">
            This section updates in real-time to demonstrate React's reactivity
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div className="text-center">
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#667eea" }}
            >
              {currentTime.toLocaleTimeString()}
            </div>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Current Time</p>
          </div>

          <div className="text-center">
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#667eea" }}
            >
              {Math.floor(Math.random() * 1000)}
            </div>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Random Number</p>
          </div>

          <div className="text-center">
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "#667eea" }}
            >
              {features.length}
            </div>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Features</p>
          </div>
        </div>

        <div className="text-center mt-4">
          <button
            className="btn btn-primary"
            onClick={() => setAnimationKey((prev) => prev + 1)}
          >
            🔄 Trigger Re-render
          </button>
        </div>
      </div>
    </div>
  );
};

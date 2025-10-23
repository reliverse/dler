import React, { useEffect, useState } from "react";
import "./ModernFeatures.css";

// Example of CSS Modules usage
import styles from "./ModernFeatures.module.css";

// Example of SVG as React component (would be transformed by svgAsReact plugin)
const ReactIcon = () => (
  <svg
    fill="none"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
      fill="currentColor"
    />
  </svg>
);

// Example of Web Worker usage (would be supported by workerSupport plugin)
const useWorker = () => {
  const [workerResult, setWorkerResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // In the future, this would use a Web Worker
    // const worker = new Worker('./heavy-computation.worker.js');
    // worker.postMessage({ data: 'heavy computation' });
    // worker.onmessage = (e) => setWorkerResult(e.data);

    // For demo purposes, simulate worker result
    setIsLoading(true);
    setTimeout(() => {
      setWorkerResult("Worker computation completed!");
      setIsLoading(false);
    }, 2000);
  }, []);

  return { workerResult, isLoading };
};

const ModernFeatures: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<string>("css-modules");
  const { workerResult, isLoading } = useWorker();

  const features = [
    {
      id: "css-modules",
      title: "CSS Modules",
      description: "Scoped CSS with automatic class name generation",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>CSS Modules Example</h3>
          <p className={styles.featureDescription}>
            This card uses CSS Modules for scoped styling. The class names are
            automatically generated to prevent conflicts.
          </p>
        </div>
      ),
    },
    {
      id: "svg-as-react",
      title: "SVG as React Components",
      description: "Transform SVG files into React components",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>SVG as React</h3>
          <div className={styles.iconContainer}>
            <ReactIcon />
            <span>This SVG is transformed into a React component</span>
          </div>
        </div>
      ),
    },
    {
      id: "web-workers",
      title: "Web Workers",
      description: "Background processing with Web Workers",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>Web Worker Example</h3>
          <div className={styles.workerContainer}>
            {isLoading ? (
              <div className={styles.loading}>Processing...</div>
            ) : (
              <div className={styles.result}>{workerResult}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "react-fast-refresh",
      title: "React Fast Refresh",
      description: "Hot reloading for React components",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>Fast Refresh</h3>
          <p className={styles.featureDescription}>
            Edit this component and see it update instantly without losing
            state! Try changing the text above.
          </p>
        </div>
      ),
    },
    {
      id: "bundle-analysis",
      title: "Bundle Analysis",
      description: "Detailed bundle size and performance analysis",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>Bundle Analysis</h3>
          <div className={styles.analysisContainer}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Bundle Size:</span>
              <span className={styles.metricValue}>~2.1MB</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Chunks:</span>
              <span className={styles.metricValue}>5</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Assets:</span>
              <span className={styles.metricValue}>12</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "performance-monitoring",
      title: "Performance Monitoring",
      description: "Real-time performance metrics and budgets",
      example: (
        <div className={styles.featureCard}>
          <h3 className={styles.featureTitle}>Performance Metrics</h3>
          <div className={styles.performanceContainer}>
            <div className={styles.performanceBar}>
              <div
                className={styles.performanceFill}
                style={{ width: "75%" }}
              />
            </div>
            <span className={styles.performanceText}>
              75% of performance budget used
            </span>
          </div>
        </div>
      ),
    },
  ];

  const currentFeature =
    features.find((f) => f.id === activeFeature) || features[0];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>🚀 Modern Build Features</h2>
        <p className={styles.subtitle}>
          Showcasing Dler's enhanced capabilities with modern web technologies
        </p>
      </header>

      <nav className={styles.nav}>
        {features.map((feature) => (
          <button
            className={`${styles.navButton} ${activeFeature === feature.id ? styles.active : ""}`}
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
          >
            {feature.title}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        <div className={styles.featureInfo}>
          <h3 className={styles.featureTitle}>{currentFeature.title}</h3>
          <p className={styles.featureDescription}>
            {currentFeature.description}
          </p>
        </div>

        <div className={styles.exampleContainer}>{currentFeature.example}</div>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          These features are powered by Dler's enhanced build system with:
        </p>
        <ul className={styles.featureList}>
          <li>🔧 Advanced Bun bundler integration</li>
          <li>🔌 Extensible plugin system</li>
          <li>📊 Bundle analysis and optimization</li>
          <li>⚡ Performance monitoring</li>
          <li>🎨 Modern asset processing</li>
          <li>🔄 Hot module replacement</li>
        </ul>
      </footer>
    </div>
  );
};

export default ModernFeatures;

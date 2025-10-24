import React, { useState } from "react";

export const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);

  const increment = () => setCount((prev) => prev + step);
  const decrement = () => setCount((prev) => prev - step);
  const reset = () => setCount(0);

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h2 className="card-title">🔢 Interactive Counter</h2>
        <p className="card-description">
          A simple counter component demonstrating React state management
        </p>
      </div>

      <div className="text-center">
        <div className="mb-6">
          <div
            style={{
              fontSize: "4rem",
              fontWeight: "bold",
              color: "#667eea",
              marginBottom: "1rem",
              textShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {count}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Step size:</label>
          <input
            className="form-input"
            max="10"
            min="1"
            onChange={(e) => setStep(Number(e.target.value))}
            style={{ maxWidth: "200px", margin: "0 auto" }}
            type="number"
            value={step}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-primary" onClick={decrement}>
            -{step}
          </button>
          <button className="btn btn-secondary" onClick={reset}>
            Reset
          </button>
          <button className="btn btn-primary" onClick={increment}>
            +{step}
          </button>
        </div>
      </div>
    </div>
  );
};

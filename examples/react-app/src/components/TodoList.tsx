import React, { useState } from "react";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");

  const addTodo = () => {
    if (newTodo.trim()) {
      const todo: Todo = {
        id: Date.now(),
        text: newTodo.trim(),
        completed: false,
        createdAt: new Date(),
      };
      setTodos((prev) => [...prev, todo]);
      setNewTodo("");
    }
  };

  const toggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };

  const deleteTodo = (id: number) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const completedCount = todos.filter((todo) => todo.completed).length;
  const totalCount = todos.length;

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h2 className="card-title">📝 Todo List</h2>
        <p className="card-description">
          A todo list demonstrating React state management and list rendering
        </p>
        {totalCount > 0 && (
          <p style={{ color: "#667eea", fontWeight: "500" }}>
            Progress: {completedCount}/{totalCount} completed
          </p>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="form-input"
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a new todo..."
            type="text"
            value={newTodo}
          />
          <button className="btn btn-primary" onClick={addTodo}>
            Add
          </button>
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="text-center" style={{ color: "#666", padding: "2rem" }}>
          <p>No todos yet. Add one above! 🎯</p>
        </div>
      ) : (
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {todos.map((todo) => (
            <div
              className="slide-in"
              key={todo.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.75rem",
                border: "1px solid #f0f0f0",
                borderRadius: "0.5rem",
                marginBottom: "0.5rem",
                backgroundColor: todo.completed ? "#f8f9fa" : "white",
                opacity: todo.completed ? 0.7 : 1,
              }}
            >
              <input
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                style={{ marginRight: "0.75rem", transform: "scale(1.2)" }}
                type="checkbox"
              />
              <span
                style={{
                  flex: 1,
                  textDecoration: todo.completed ? "line-through" : "none",
                  color: todo.completed ? "#666" : "#333",
                }}
              >
                {todo.text}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => deleteTodo(todo.id)}
                style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.8rem",
                  marginLeft: "0.5rem",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

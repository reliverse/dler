import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  askQuestion,
  confirmPrompt,
  multiselectPrompt,
  selectPrompt,
} from "@reliverse/dler-prompt";

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

const todos: Todo[] = [];
let nextId = 1;

export default defineCmd(
  async (args) => {
    if (args.action === "add") {
      const task = await askQuestion("Enter a new task:");
      if (!task.trim()) {
        logger.error("Task cannot be empty!");
        return;
      }

      const priority = await selectPrompt({
        title: "Select priority:",
        options: [
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
        ],
      });

      todos.push({
        id: nextId++,
        task: task.trim(),
        completed: false,
        priority: priority as "low" | "medium" | "high",
      });

      logger.success(`✅ Added task: ${task.trim()} (${priority} priority)`);
    } else if (args.action === "list") {
      if (todos.length === 0) {
        logger.log("📝 No tasks yet. Use 'add' to create one!");
        return;
      }

      logger.log("\n📋 Your Tasks:\n");
      for (const todo of todos) {
        const status = todo.completed ? "✅" : "⏳";
        const priorityEmoji =
          todo.priority === "high"
            ? "🔴"
            : todo.priority === "medium"
              ? "🟡"
              : "🟢";
        logger.log(
          `${status} ${priorityEmoji} [${todo.id}] ${todo.task} (${todo.priority})`,
        );
      }
      logger.log("");
    } else if (args.action === "complete") {
      if (todos.length === 0) {
        logger.log("📝 No tasks to complete!");
        return;
      }

      const incompleteTodos = todos.filter((t) => !t.completed);
      if (incompleteTodos.length === 0) {
        logger.log("🎉 All tasks are already completed!");
        return;
      }

      const taskOptions = incompleteTodos.map((t) => ({
        value: String(t.id),
        label: `[${t.id}] ${t.task} (${t.priority})`,
      }));

      const selected = await multiselectPrompt({
        title: "Select tasks to mark as completed:",
        options: taskOptions,
      });

      for (const taskId of selected) {
        const id = Number.parseInt(taskId, 10);
        const todo = todos.find((t) => t.id === id);
        if (todo) {
          todo.completed = true;
          logger.success(`✅ Completed: ${todo.task}`);
        }
      }
    } else if (args.action === "delete") {
      if (todos.length === 0) {
        logger.log("📝 No tasks to delete!");
        return;
      }

      const taskOptions = todos.map((t) => ({
        value: String(t.id),
        label: `[${t.id}] ${t.task} ${t.completed ? "(completed)" : ""}`,
      }));

      const selected = await multiselectPrompt({
        title: "Select tasks to delete:",
        options: taskOptions,
      });

      const confirm = await confirmPrompt(
        `Are you sure you want to delete ${selected.length} task(s)?`,
        false,
      );

      if (confirm) {
        for (const taskId of selected) {
          const id = Number.parseInt(taskId, 10);
          const index = todos.findIndex((t) => t.id === id);
          if (index !== -1) {
            const deleted = todos.splice(index, 1)[0];
            if (deleted) {
              logger.success(`🗑️  Deleted: ${deleted.task}`);
            }
          }
        }
      } else {
        logger.log("❌ Deletion cancelled.");
      }
    } else if (args.action === "clear") {
      if (todos.length === 0) {
        logger.log("📝 No tasks to clear!");
        return;
      }

      const confirm = await confirmPrompt(
        "Are you sure you want to clear all tasks?",
        false,
      );

      if (confirm) {
        const count = todos.length;
        todos.length = 0;
        logger.success(`🗑️  Cleared ${count} task(s).`);
      } else {
        logger.log("❌ Clear cancelled.");
      }
    }
  },
  defineCmdArgs({
    action: {
      type: "string",
      description: "Action to perform",
      required: true,
      validate: (value) => {
        const validActions = ["add", "list", "complete", "delete", "clear"];
        if (!validActions.includes(value)) {
          return `Action must be one of: ${validActions.join(", ")}`;
        }
        return true;
      },
    },
  }),
  defineCmdCfg({
    name: "todo",
    description: "Interactive todo list manager",
    examples: [
      "cli-app todo --action add",
      "cli-app todo --action list",
      "cli-app todo --action complete",
      "cli-app todo --action delete",
      "cli-app todo --action clear",
    ],
  }),
);

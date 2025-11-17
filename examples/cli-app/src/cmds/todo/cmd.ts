import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  askQuestion,
  confirmPrompt,
  multiselectPrompt,
  type SelectionItem,
  selectPrompt,
  spinnerPrompt,
} from "@reliverse/dler-prompt";

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

const todos: Todo[] = [];
let nextId = 1;

export default defineCommand({
  meta: {
    name: "todo",
    description: "Interactive todo list manager",
    examples: [
      "cli-app todo --action add",
      "cli-app todo --action list",
      "cli-app todo --action complete",
      "cli-app todo --action delete",
      "cli-app todo --action clear",
    ],
  },
  args: defineArgs({
    action: {
      type: "string",
      description: "Action to perform",
      required: true,
      validate: (value: string) => {
        const validActions = ["add", "list", "complete", "delete", "clear"];
        if (!validActions.includes(value)) {
          return `Action must be one of: ${validActions.join(", ")}`;
        }
        return true;
      },
    },
  }),
  run: async ({ args }) => {
    if (args.action === "add") {
      const task = await askQuestion("Enter a new task:");
      if (!task.trim()) {
        logger.error("Task cannot be empty!");
        return;
      }

      const test = await selectPrompt<"1" | "2" | "3">({
        title: "Select an item:",
        options: [
          { value: "1", label: "Item 1" },
          { value: "2", label: "Item 2" },
          { value: "3", label: "Item 3" },
        ],
      });
      switch (test) {
        case "1":
          logger.success("Item 1 selected");
          break;
        case "2":
          logger.success("Item 2 selected");
          break;
        case "3":
          logger.success("Item 3 selected");
          break;
      }

      const multiTest = await multiselectPrompt<"a" | "b" | "c">({
        title: "Select multiple items:",
        options: [
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
          { value: "c", label: "Option C" },
        ],
      });

      for (const item of multiTest) {
        switch (item) {
          case "a":
            logger.success("Selected A");
            break;
          case "b":
            logger.success("Selected B");
            break;
          case "c":
            logger.success("Selected C");
            break;
        }
      }

      const priorityOptions = [
        { value: "low", label: "low" },
        { value: "medium", label: "medium" },
        { value: "high", label: "high", hint: "High priority" },
      ] as const satisfies readonly SelectionItem[];
      let priority: "low" | "medium" | "high";
      try {
        priority = await selectPrompt({
          title: "Select priority:",
          options: priorityOptions,
        });
      } catch (error) {
        logger.error(
          error instanceof Error
            ? error.message
            : "Priority selection cancelled",
        );
        return;
      }

      todos.push({
        id: nextId++,
        task: task.trim(),
        completed: false,
        priority,
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

      let selectedTaskIds: string[];
      try {
        selectedTaskIds = await multiselectPrompt({
          title: "Select tasks to mark as completed:",
          options: taskOptions,
        });
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : "Selection cancelled",
        );
        return;
      }

      const completeSpinner = spinnerPrompt({
        text: "Completing tasks...",
        indicator: "dots",
      });
      completeSpinner.start();

      const completedTasks: Todo[] = [];
      for (const taskId of selectedTaskIds) {
        const id = Number.parseInt(taskId, 10);
        const todo = todos.find((t) => t.id === id);
        if (todo) {
          todo.completed = true;
          completedTasks.push(todo);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      completeSpinner.succeed(`Completed ${selectedTaskIds.length} task(s)!`);
      for (const todo of completedTasks) {
        logger.success(`✅ Completed: ${todo.task}`);
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

      let selectedTaskIds: string[];
      try {
        selectedTaskIds = await multiselectPrompt({
          title: "Select tasks to delete:",
          options: taskOptions,
        });
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : "Selection cancelled",
        );
        return;
      }

      const confirmResult = await confirmPrompt({
        title: `Are you sure you want to delete ${selectedTaskIds.length} task(s)?`,
      });

      if (
        confirmResult.error ||
        confirmResult.confirmed === null ||
        !confirmResult.confirmed
      ) {
        logger.log("❌ Deletion cancelled.");
        return;
      }

      const deleteSpinner = spinnerPrompt({
        text: "Deleting tasks...",
        indicator: "dots",
      });
      deleteSpinner.start();

      const deletedTasks: Todo[] = [];
      for (const taskId of selectedTaskIds) {
        const id = Number.parseInt(taskId, 10);
        const index = todos.findIndex((t) => t.id === id);
        if (index !== -1) {
          const deleted = todos.splice(index, 1)[0];
          if (deleted) {
            deletedTasks.push(deleted);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }

      deleteSpinner.succeed(`Deleted ${selectedTaskIds.length} task(s)!`);
      for (const deleted of deletedTasks) {
        logger.success(`🗑️  Deleted: ${deleted.task}`);
      }
    } else if (args.action === "clear") {
      if (todos.length === 0) {
        logger.log("📝 No tasks to clear!");
        return;
      }

      const confirmResult = await confirmPrompt({
        title: "Are you sure you want to clear all tasks?",
      });

      if (
        confirmResult.error ||
        confirmResult.confirmed === null ||
        !confirmResult.confirmed
      ) {
        logger.log("❌ Clear cancelled.");
        return;
      }

      const count = todos.length;
      todos.length = 0;
      logger.success(`🗑️  Cleared ${count} task(s).`);
    }
  },
});

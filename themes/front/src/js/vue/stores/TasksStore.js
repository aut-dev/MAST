/* globals Craft */

import { defineStore } from "pinia";
import axios from "axios";
import { findIndex } from "lodash";

export const useTasksStore = defineStore("tasks", {
  state: () => ({
    onUnlimitedBreak: false,
    onScheduledBreak: false,
    initialTaskLoading: true,
    disableFetchingTasks: false,
    hideInactiveTasks: false,
    showArchivedTasks: false,
    doning: false,
    pausing: false,
    reordering: false,
    tasks: [],
  }),
  actions: {
    fetchTasks() {
      if (this.disableFetchingTasks) {
        return;
      }
      this.disableFetchingTasks = true;
      axios
        .get(
          "/?action=plugin-tasks/tasks/get&archives=" +
            (this.showArchivedTasks ? 1 : 0),
        )
        .then((data) => {
          this.tasks = data.data;
          this.initialTaskLoading = false;
          this.disableFetchingTasks = false;
        });
    },
    fetchTask(id) {
      this.disableFetchingTasks = true;
      axios.get("/?action=plugin-tasks/tasks/get&id=" + id).then((data) => {
        let index = findIndex(this.tasks, (task) => {
          return task.id == id;
        });
        this.tasks[index] = data.data[0];
        this.disableFetchingTasks = false;
      });
    },
    setUnlimitedBreak(value) {
      this.disableFetchingTasks = true;
      this.onUnlimitedBreak = value;
      axios
        .post(
          "/?action=plugin-users/breaks/set-unlimited-break",
          {
            unlimitedBreak: value,
          },
          {
            headers: { "X-CSRF-Token": Craft.csrfToken },
          },
        )
        .then(() => {
          this.disableFetchingTasks = false;
        });
    },
    setHideInactiveTasks(value) {
      this.hideInactiveTasks = value;
      axios.post(
        "/?action=plugin-users/users/set-hide-inactive-tasks",
        {
          hideInactiveTasks: value,
        },
        {
          headers: { "X-CSRF-Token": Craft.csrfToken },
        },
      );
    },
    setShowArchivedTasks(value) {
      this.showArchivedTasks = value;
      this.fetchTasks();
    },
    setTaskDone(id, done, deadlineHasPassed) {
      if (this.doning) {
        return;
      }
      this.doning = true;
      this.disableFetchingTasks = true;
      let index = findIndex(this.tasks, (task) => {
        return task.id == id;
      });
      let task = this.tasks[index];
      task.daily.complete = done;
      if (!done && deadlineHasPassed) {
        task.daily.derailed = true;
      }
      axios
        .post(
          "/",
          {
            action: "entries/save-entry",
            entryId: task.daily.id,
            fields: {
              done: done ? 1 : 0,
            },
          },
          {
            headers: {
              "X-CSRF-Token": Craft.csrfToken,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        )
        .then(() => {
          this.doning = false;
          this.disableFetchingTasks = false;
        });
    },
    setTaskPaused(id, paused) {
      if (this.pausing) {
        return;
      }
      this.pausing = true;
      this.disableFetchingTasks = true;
      let index = findIndex(this.tasks, (task) => {
        return task.id == id;
      });
      let task = this.tasks[index];
      task.paused = paused;
      axios
        .post(
          "/",
          {
            action: "entries/save-entry",
            entryId: id,
            fields: {
              paused: paused ? 1 : 0,
            },
          },
          {
            headers: {
              "X-CSRF-Token": Craft.csrfToken,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        )
        .then(() => {
          this.pausing = false;
          this.disableFetchingTasks = false;
        });
    },
    reorder() {
      if (this.reordering) {
        return;
      }
      this.reordering = true;
      this.disableFetchingTasks = true;
      let data = [];
      for (let i in this.tasks) {
        data.push({
          order: i,
          id: this.tasks[i].id,
        });
      }
      axios
        .post(
          "/?action=plugin-tasks/tasks/reorder",
          { data: data },
          {
            headers: { "X-CSRF-Token": Craft.csrfToken },
          },
        )
        .then(() => {
          this.reordering = false;
          this.disableFetchingTasks = false;
        });
    },
  },
});

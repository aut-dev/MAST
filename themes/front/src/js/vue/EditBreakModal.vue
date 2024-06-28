<template>
  <div class="modal fade" tabindex="-1" id="edit-break-modal">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <form>
          <div class="modal-header">
            <h5 class="modal-title">
              <span v-if="breakk.id">{{ t("Edit break") }}</span>
              <span v-if="!breakk.id">{{ t("Add break") }}</span>
            </h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3 field-title">
              <label class="required">{{ t("Title") }}</label>
              <input
                type="text"
                name="title"
                class="form-control"
                v-model="breakk.title"
              />
            </div>
            <div class="form-group mb-3 field-startDate">
              <label for="startDate" class="required">{{
                t("Start date")
              }}</label>
              <div>
                <input
                  type="text"
                  name="startDate"
                  class="form-control datepicker"
                />
              </div>
            </div>
            <div class="form-group mb-3 field-endDate">
              <label for="endDate" class="required">{{ t("End date") }}</label>
              <div>
                <input
                  type="text"
                  name="endDate"
                  class="form-control datepicker"
                />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              {{ t("Close") }}
            </button>
            <button type="button" class="btn btn-primary" @click="submitModal">
              <span
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
                v-if="submitting"
              ></span>
              {{ t("Save") }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  props: {
    breakk: Object,
    sectionId: Number,
  },
  data() {
    return {
      submitting: false,
      startDateInstance: null,
      endDateInstance: null,
    };
  },
  mounted() {
    App.getBootstrap().then((bootstrap) => {
      this.modal = new bootstrap.Modal(
        document.getElementById("edit-break-modal"),
      );
    });
    import(/* webpackChunkName: "flatpickr" */ "../components/flatpickr").then(
      (chunk) => {
        let options = {
          static: true,
          disableMobile: true,
          altInput: true,
          dateFormat: "Y-m-d",
          altFormat: "d/m/Y",
        };
        this.startDateInstance = chunk.flatpickr("[name=startDate]", options);
        this.endDateInstance = chunk.flatpickr("[name=endDate]", options);
      },
    );
  },
  watch: {
    breakk: function () {
      this.startDateInstance.setDate(this.breakk.startDate);
      this.endDateInstance.setDate(this.breakk.endDate);
    },
  },
  methods: {
    submitModal() {
      this.submitting = true;
      axios
        .post(
          "/",
          {
            action: "entries/save-entry",
            sectionId: this.sectionId,
            entryId: this.breakk.id,
            title: this.breakk.title,
            fields: {
              startDate: {
                timezone: Craft.timezone,
                datetime: this.startDateInstance.input.value,
              },
              endDate: {
                timezone: Craft.timezone,
                datetime: this.endDateInstance.input.value,
              },
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
          App.addToast(this.t("Break saved"));
          this.submitting = false;
          this.$emit("breakSaved");
          this.modal.hide();
        })
        .catch((response) => {
          response = response.response;
          let data = response.data;
          data.status = response.status;
          App.handleError(data, document.querySelector("#edit-break-modal"));
          this.submitting = false;
        });
    },
  },
};
</script>

(function initLocalApi() {
  async function request(path, options) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Local API request failed: ${response.status}`);
    }

    return payload;
  }

  window.localApi = {
    async health() {
      return request("/api/health");
    },
    async listProjects() {
      return request("/api/projects");
    },
    async loadCurrentProject() {
      return request("/api/projects/current");
    },
    async saveCurrentProject(project, name) {
      return request("/api/projects/current", {
        method: "PUT",
        body: JSON.stringify({ project, name }),
      });
    },
    async loadCompanyProfile() {
      return request("/api/company/profile");
    },
    async saveCompanyProfile(profile) {
      return request("/api/company/profile", {
        method: "PUT",
        body: JSON.stringify({ profile }),
      });
    },
    async createBackup() {
      return request("/api/backups", { method: "POST", body: "{}" });
    },
    async loadCurrentPriceCatalog() {
      return request("/api/prices/current");
    },
    async saveCurrentPriceCatalog(catalog) {
      return request("/api/prices/current", {
        method: "PUT",
        body: JSON.stringify({ catalog }),
      });
    },
  };
})();

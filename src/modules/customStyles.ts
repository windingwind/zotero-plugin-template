import { getString } from "../utils/locale";
import { getColors } from "../utils/theme";
import { csLog } from "../utils/logger";
import { API_BASE, LicenseStatus } from "./license";

interface StyleData {
  id: string;
  name: string;
  remoteDate: Date | null;
  hash: string;
}

class CustomStylesManager {
  // ─── Crypto ───────────────────────────────────────────────────

  private async computeSHA256(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // ─── Remote API ───────────────────────────────────────────────

  private async fetchWithTimeout(url: string, timeoutMs = 10000): Promise<any> {
    const zotero = ztoolkit.getGlobal("Zotero");
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs),
    );
    return Promise.race([
      zotero.HTTP.request("GET", url, { responseType: "json" }),
      timeout,
    ]);
  }

  private async fetchRemoteStyles(licenseKey: string): Promise<StyleData[]> {
    csLog("INFO", "Fetching remote styles list");
    try {
      const response = await this.fetchWithTimeout(
        `${API_BASE}/styles?license_key=${encodeURIComponent(licenseKey)}`,
      );
      const styles = response.response as unknown as any[];
      csLog(
        "INFO",
        `Remote styles fetched: ${(styles as any[]).length} styles`,
      );
      return styles.map((s: any) => ({
        id: s.id,
        name: s.name,
        remoteDate: s.updated ? new Date(s.updated) : null,
        hash: s.hash ?? "",
      }));
    } catch (e) {
      csLog("ERROR", "fetchRemoteStyles error:", e);
      return [];
    }
  }

  private async fetchRemoteStyleContent(
    styleId: string,
    licenseKey: string,
    expectedHash: string,
  ): Promise<string> {
    const response = await this.fetchWithTimeout(
      `${API_BASE}/styles/${styleId}?license_key=${encodeURIComponent(licenseKey)}`,
    );
    const data = response.response as unknown as { content: string };
    if (!data.content) throw new Error("No content in response");

    const actualHash = await this.computeSHA256(data.content);
    if (actualHash !== expectedHash) {
      csLog(
        "ERROR",
        `Hash mismatch for ${styleId}: expected ${expectedHash}, got ${actualHash}`,
      );
      throw new Error(
        "File integrity check failed. Please try again or contact support.",
      );
    }

    return data.content;
  }

  // ─── Zotero Style Helpers ─────────────────────────────────────

  private getInstalledStyleDate(styleId: string): Date | null {
    try {
      const zotero = ztoolkit.getGlobal("Zotero");
      const id = `http://www.zotero.org/styles/${styleId}`;
      const installedStyle = zotero.Styles.get(id);
      if (!installedStyle?.updated) return null;
      const parsed = new Date(installedStyle.updated.replace(" ", "T") + "Z");
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (e) {
      csLog("ERROR", "getInstalledStyleDate error:", e);
      return null;
    }
  }

  private getStyleStatus(
    style: StyleData,
  ): "not-installed" | "up-to-date" | "update-available" {
    const installedDate = this.getInstalledStyleDate(style.id);
    if (!installedDate) return "not-installed";
    if (style.remoteDate && style.remoteDate > installedDate)
      return "update-available";
    return "up-to-date";
  }

  async installStyleToZotero(styleId: string, styleContent: string) {
    csLog("INFO", `Installing style: ${styleId}`);
    try {
      const zotero = ztoolkit.getGlobal("Zotero");
      if (!zotero) throw new Error("Zotero global not found");
      const style = await zotero.Styles.install(styleContent, null, true);
      csLog("INFO", `Style installed: ${style.title}`);
    } catch (e) {
      csLog("ERROR", "installStyleToZotero error:", e);
      throw e;
    }
  }

  // ─── Check & Install Updates ──────────────────────────────────

  public async checkAndInstallUpdates(
    doc: Document,
    win: Window,
    container: HTMLElement,
    statusEl: HTMLElement,
    licenseKey: string,
  ): Promise<number> {
    csLog("INFO", "Checking for style updates");
    const styles = await this.fetchRemoteStyles(licenseKey);

    if (styles.length === 0) {
      throw new Error("Could not fetch styles from server.");
    }

    const updatable = styles.filter(
      (s) => this.getStyleStatus(s) === "update-available",
    );

    container.innerHTML = "";
    for (const style of styles) {
      const row = this.buildStyleRow(doc, win, style, async (s, btn) => {
        btn.textContent = getString("btn-installing");
        btn.setAttribute("disabled", "true");
        try {
          const content = await this.fetchRemoteStyleContent(
            s.id,
            licenseKey,
            s.hash,
          );
          await this.installStyleToZotero(s.id, content);
          statusEl.textContent = getString("status-updated-ok", {
            args: { name: s.name },
          });
          statusEl.style.color = getColors(win).success;
          await this.checkAndInstallUpdates(
            doc,
            win,
            container,
            statusEl,
            licenseKey,
          );
        } catch (e) {
          btn.textContent = getString("btn-failed");
          btn.style.borderColor = getColors(win).error;
          btn.removeAttribute("disabled");
          statusEl.textContent = getString("status-install-failed", {
            args: { name: s.name },
          });
          statusEl.style.color = getColors(win).error;
        }
      });
      container.appendChild(row);
    }

    return updatable.length;
  }

  // ─── UI: Row Builder ──────────────────────────────────────────

  private buildStyleRow(
    doc: Document,
    win: Window,
    style: StyleData,
    onInstall: (
      style: StyleData,
      btn: HTMLElement,
      row: HTMLElement,
    ) => Promise<void>,
    installedIds?: Set<string>,
  ): HTMLElement {
    const status = installedIds?.has(style.id)
      ? "up-to-date"
      : this.getStyleStatus(style);
    const installedDate = this.getInstalledStyleDate(style.id);
    const fmt = (d: Date | null) =>
      d ? d.toISOString().split("T")[0] : "unknown";
    const c = getColors(win);

    const styleRow = doc.createElement("div");
    Object.assign(styleRow.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 8px",
      borderBottom: `1px solid ${c.rowBorder}`,
      backgroundColor:
        status === "not-installed"
          ? c.rowBg
          : status === "update-available"
            ? c.rowBgWarn
            : c.rowBgOk,
    });

    const leftContainer = doc.createElement("div");
    Object.assign(leftContainer.style, {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      minWidth: "0",
    });

    const nameRow = doc.createElement("div");
    Object.assign(nameRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    });

    const statusIndicator = doc.createElement("span");
    statusIndicator.textContent =
      status === "not-installed"
        ? "○"
        : status === "update-available"
          ? "⬆"
          : "✓";
    Object.assign(statusIndicator.style, {
      fontSize: "16px",
      flexShrink: "0",
      color:
        status === "not-installed"
          ? c.mutedText
          : status === "update-available"
            ? c.warning
            : c.success,
    });

    const styleName = doc.createElement("span");
    styleName.textContent = style.name;
    Object.assign(styleName.style, { fontSize: "14px", fontWeight: "600" });

    nameRow.appendChild(statusIndicator);
    nameRow.appendChild(styleName);

    if (status === "up-to-date") {
      const badge = doc.createElement("span");
      badge.textContent = getString("badge-latest");
      Object.assign(badge.style, {
        fontSize: "11px",
        color: c.success,
        backgroundColor: c.badgeOkBg,
        border: `1px solid ${c.badgeOkBdr}`,
        borderRadius: "10px",
        padding: "1px 8px",
        fontWeight: "500",
        alignSelf: "center",
        whiteSpace: "nowrap",
      });
      nameRow.appendChild(badge);
    }

    if (status === "update-available") {
      const badge = doc.createElement("span");
      badge.textContent = getString("badge-update");
      Object.assign(badge.style, {
        fontSize: "11px",
        color: c.warning,
        backgroundColor: c.badgeUpdBg,
        border: `1px solid ${c.badgeUpdBdr}`,
        borderRadius: "10px",
        padding: "1px 8px",
        fontWeight: "500",
        alignSelf: "center",
        whiteSpace: "nowrap",
      });
      nameRow.appendChild(badge);
    }

    leftContainer.appendChild(nameRow);

    const dateInfo = doc.createElement("div");
    Object.assign(dateInfo.style, {
      fontSize: "11px",
      marginTop: "3px",
      paddingLeft: "24px",
    });

    if (status === "not-installed") {
      dateInfo.textContent = getString("date-available", {
        args: { date: fmt(style.remoteDate) },
      });
      dateInfo.style.color = c.mutedText;
    } else if (status === "update-available") {
      dateInfo.textContent = getString("date-update", {
        args: {
          installedDate: fmt(installedDate),
          newDate: fmt(style.remoteDate),
        },
      });
      dateInfo.style.color = c.warning;
    } else {
      dateInfo.textContent = getString("date-installed", {
        args: { date: fmt(installedDate) },
      });
      dateInfo.style.color = c.mutedText;
    }
    leftContainer.appendChild(dateInfo);

    const btnColor =
      status === "not-installed"
        ? c.success
        : status === "update-available"
          ? c.warning
          : c.btnDisabled;
    const btnLabel =
      status === "not-installed"
        ? getString("btn-install")
        : status === "update-available"
          ? getString("btn-update")
          : getString("btn-reinstall");

    const installButton = doc.createElement("button");
    installButton.setAttribute("type", "button");
    installButton.textContent = btnLabel;
    Object.assign(installButton.style, {
      padding: "5px 14px",
      backgroundColor: "transparent",
      color: c.btnText,
      border: `2px solid ${btnColor}`,
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      flexShrink: "0",
      marginLeft: "12px",
      alignSelf: "center",
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: status === "up-to-date" ? "0.5" : "1",
    });

    installButton.addEventListener("click", async () => {
      await onInstall(style, installButton, styleRow);
    });

    styleRow.appendChild(leftContainer);
    styleRow.appendChild(installButton);
    return styleRow;
  }

  // ─── UI: Prefs Panel ──────────────────────────────────────────

  public async renderStylesInPrefs(
    doc: Document,
    win: Window,
    container: HTMLElement,
    statusEl: HTMLElement,
    licenseStatus: LicenseStatus,
    licenseKey: string,
  ) {
    container.innerHTML = "";
    statusEl.textContent = getString("status-loading-styles");
    statusEl.style.color = getColors(win).neutral;

    const styles = await this.fetchRemoteStyles(licenseKey);

    if (styles.length === 0) {
      statusEl.textContent = getString("status-no-styles");
      statusEl.style.color = getColors(win).error;
      return;
    }

    statusEl.textContent = getString(
      styles.length === 1
        ? "status-styles-found"
        : "status-styles-found-plural",
      { args: { count: styles.length } },
    );
    statusEl.style.color = getColors(win).success;
    container.innerHTML = "";

    const justInstalled = new Set<string>();

    const render = () => {
      container.innerHTML = "";
      for (const style of styles) {
        const row = this.buildStyleRow(doc, win, style, async (s, btn) => {
          btn.textContent = getString("btn-installing");
          btn.setAttribute("disabled", "true");
          try {
            const content = await this.fetchRemoteStyleContent(
              s.id,
              licenseKey,
              s.hash,
            );
            await this.installStyleToZotero(s.id, content);
            justInstalled.add(s.id);
            statusEl.textContent = getString("status-installed-ok", {
              args: { name: s.name },
            });
            statusEl.style.color = getColors(win).success;
            render();
          } catch (e) {
            csLog("ERROR", "Install error:", e);
            btn.textContent = getString("btn-failed");
            btn.style.borderColor = getColors(win).error;
            btn.removeAttribute("disabled");
            statusEl.textContent = getString("status-install-failed", {
              args: { name: s.name },
            });
            statusEl.style.color = getColors(win).error;
          }
        }, justInstalled);
        container.appendChild(row);
      }
    };

    render();
  }
}

export const customStylesManager = new CustomStylesManager();

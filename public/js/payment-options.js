// File: /public/js/payment-options.js
// Brief description: Loads checkout payment-provider readiness details and updates the
// checkout payment method UI with live/stub availability notes so customers can see which
// provider is actually configured versus still using the current fallback bridge.

document.addEventListener("DOMContentLoaded", () => {
  const selectEl = document.getElementById("payment_method");
  const statusEl = document.getElementById("paymentProviderStatus");

  if (!selectEl || !statusEl) return;

  let providerMap = new Map();

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.display = message ? "block" : "none";
    statusEl.style.color = isError ? "#b00020" : "";
  }

  function describeProvider(code) {
    const provider = providerMap.get(String(code || "").trim().toLowerCase());
    if (!provider) {
      return "Selected payment option will use the current checkout bridge.";
    }

    if (provider.code === "manual" || provider.code === "other") {
      return `${provider.label} will create the order and leave payment for manual follow-up.`;
    }

    if (provider.ready) {
      if (provider.code === "paypal") {
        return `${provider.label} is configured and can hand off to a ${provider.mode} redirect flow.`;
      }
      return `${provider.label} is configured for a future live handoff path.`;
    }

    return `${provider.label} is not configured live yet. The order will still be created and payment will remain in bridge mode.`;
  }

  async function loadProviders() {
    try {
      setStatus("Loading payment options...");

      const response = await fetch("/api/payment-providers", {
        method: "GET"
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load payment options.");
      }

      const providers = Array.isArray(data.providers) ? data.providers : [];
      providerMap = new Map(providers.map((provider) => [String(provider.code || "").toLowerCase(), provider]));

      Array.from(selectEl.options).forEach((option) => {
        const provider = providerMap.get(String(option.value || "").toLowerCase());
        if (!provider) return;

        if (!provider.ready && !["manual", "other"].includes(provider.code)) {
          option.textContent = `${provider.label} (bridge mode)`;
        } else if (provider.code === "paypal" && provider.ready) {
          option.textContent = `${provider.label} (${provider.mode})`;
        }
      });

      setStatus(describeProvider(selectEl.value));
    } catch (error) {
      setStatus(error.message || "Unable to load payment option readiness.", true);
    }
  }

  selectEl.addEventListener("change", () => {
    setStatus(describeProvider(selectEl.value));
  });

  loadProviders();
});

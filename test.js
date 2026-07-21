const { betterAuth } = require("better-auth");
try {
  const auth = betterAuth({ secret: "test", emailAndPassword: { enabled: true } });
  console.log("Success");
} catch (e) {
  console.error("Crash:", e);
}

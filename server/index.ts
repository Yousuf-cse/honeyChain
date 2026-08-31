import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🐝 HoneyChain Web3 Middleware API running on port ${PORT}`);
  console.log(`  🔗 REST Gateway: http://localhost:${PORT}`);
  console.log(`  🩺 Health check: http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

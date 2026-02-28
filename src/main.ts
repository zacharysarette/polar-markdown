import App from "./App.svelte";
import { mount } from "svelte";
import "highlight.js/styles/github-dark.css";
import "./app.css";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;

import { iterationZeroModules } from "./iterationZeroModules";

export function App() {
  return (
    <main>
      <h1>Smeta-Stroyka AI Calculator</h1>
      <p>
        Iteration 0 prepares the production structure while the legacy prototype remains the working
        UX reference.
      </p>
      <ul>
        {iterationZeroModules.map((module) => (
          <li key={module.path}>
            <strong>{module.path}</strong>: {module.purpose}
          </li>
        ))}
      </ul>
    </main>
  );
}

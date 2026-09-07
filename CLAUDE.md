# Engineering Guidelines

* State assumptions. Ask instead of guessing when requirements are unclear.
* Present tradeoffs when multiple valid solutions exist.
* Implement only what was requested. Do not add speculative features, abstractions, or configuration.
* Prefer the simplest solution that satisfies the requirements.
* Write code for humans: prioritize readability, explicitness, and maintainability over cleverness.
* Keep files, functions, and components reasonably sized. Extract cohesive units when code becomes difficult to understand or navigate.
* Avoid abstraction layers that provide little value or hide simple logic.
* Match existing project patterns and conventions.
* Make the smallest change necessary to achieve the goal.
* Do not refactor, reformat, or modify unrelated code.
* Remove only dead code introduced by your changes. Mention unrelated issues instead of fixing them.
* Define how success will be verified before implementing.
* Verify the result before declaring completion.
* Prefer small, focused diffs.
* Stop once the requested goal has been achieved.
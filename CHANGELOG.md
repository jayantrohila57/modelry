# Changelog

## [0.3.0](https://github.com/jayantrohila57/modelry/compare/modelry-v0.2.0...modelry-v0.3.0) (2026-10-30)


### Features

* **chat:** complete recovery and context safeguards ([11377e9](https://github.com/jayantrohila57/modelry/commit/11377e94b1508d24d461bbfb17b599333e6d740a)), closes [#29](https://github.com/jayantrohila57/modelry/issues/29)
* **chat:** complete remaining dashboard UX checklist ([#26](https://github.com/jayantrohila57/modelry/issues/26)) ([970d6a3](https://github.com/jayantrohila57/modelry/commit/970d6a3fadfaeedfb7ab6e1363a067524e536a19))
* **chat:** harden lifecycle and structured message persistence ([06b338f](https://github.com/jayantrohila57/modelry/commit/06b338f51739705883259ab68790c1d5b470a961))
* **chat:** harden lifecycle and structured message persistence ([a8f0df9](https://github.com/jayantrohila57/modelry/commit/a8f0df997833f7d46ab2675e6cf40cf3f04ab343))
* **chat:** improve dashboard navigation and recovery ([4e4e3bd](https://github.com/jayantrohila57/modelry/commit/4e4e3bd96cb4ee19c89cb7131a1faf851662896c))
* **chat:** refresh chat UI with shadcn primitives ([5a6f817](https://github.com/jayantrohila57/modelry/commit/5a6f8178a3bef5ffaa27776755b7efc1e04d70b5))
* **chat:** scale message history and harden streaming ([0a8d52f](https://github.com/jayantrohila57/modelry/commit/0a8d52f14f9fd92bce694ab3d2c1be7efa5c4e81))
* improve AI chat dashboard UX ([e276480](https://github.com/jayantrohila57/modelry/commit/e276480b2ccb53beed11dfd12f0677faaee0a830))


### Bug Fixes

* **auth:** add production sign-in route ([#24](https://github.com/jayantrohila57/modelry/issues/24)) ([7057530](https://github.com/jayantrohila57/modelry/commit/7057530a3e04a32e6b600886d285fdd0e719eeb8))
* **chat:** address dashboard review findings ([1e1205e](https://github.com/jayantrohila57/modelry/commit/1e1205e16391f498d1de8292094f8a44909df782))
* **chat:** append new messages with AI SDK ([28adcaf](https://github.com/jayantrohila57/modelry/commit/28adcaf726452135956cb4f9c824eded2966a496))
* **chat:** constrain conversation to the viewport ([2877dd4](https://github.com/jayantrohila57/modelry/commit/2877dd4c2ace46799a49472ddb9707cf2a82afd6))
* **chat:** keep submitted messages recoverable ([d02ca70](https://github.com/jayantrohila57/modelry/commit/d02ca708681c5b90541621744c46028eac0f90e9))
* **chat:** preserve drafts during submission ([be4a27b](https://github.com/jayantrohila57/modelry/commit/be4a27b479b010cf9284082974c3a31a1ec1bf2d))
* **chat:** prevent inset overflow ([cadedbb](https://github.com/jayantrohila57/modelry/commit/cadedbbadc200c91fb4bf2e6095780b61d809f5e))
* **chat:** settle completion state and expand workspace ([48d2b9e](https://github.com/jayantrohila57/modelry/commit/48d2b9e6f19d5fa150f31145f53b7f0a0a35a6a5))

## [0.3.0](https://github.com/jayantrohila57/modelry/compare/modelry-v0.2.0...modelry-v0.3.0) (2026-10-30)

### Features

* preserve user-scoped chat drafts across refreshes and warn when file contents need to be reattached
* reject prompts that exceed the selected model context before persisting the new message

### Bug Fixes

* widen restored conversation context messages to accept current AI SDK message parts

## [0.2.0](https://github.com/jayantrohila57/modelry/compare/modelry-v0.1.0...modelry-v0.2.0) (2026-10-30)


### Features

* add AI chat functionality with new components and update dependencies ([6764fb5](https://github.com/jayantrohila57/modelry/commit/6764fb5226f40036ae1f84b74ef3d93065d10993))
* add AI model management and enhance chat functionality with new database schema and reasoning support ([68d03fd](https://github.com/jayantrohila57/modelry/commit/68d03fd24930fc900aebd4d8c13e5c24ce78ca71))
* add managed document assets ([#18](https://github.com/jayantrohila57/modelry/issues/18)) ([2472ce1](https://github.com/jayantrohila57/modelry/commit/2472ce12ab2d8eea689dd163523809130d9b0079)), closes [#17](https://github.com/jayantrohila57/modelry/issues/17)
* add system health check and user profile components to account module ([ca2fd43](https://github.com/jayantrohila57/modelry/commit/ca2fd438d7e79b25bb1c3d520af6532008fd58c6))
* enhance homepage layout and update authentication flow ([1c5ff89](https://github.com/jayantrohila57/modelry/commit/1c5ff89245d6b49a73c9067ababf9d202eaf1892))
* implement foundational AI chat application with backend structure, user roles, and database schema ([3e7dfb9](https://github.com/jayantrohila57/modelry/commit/3e7dfb944f378af0537ed97ae6796c5121d3b67a))
* initial commit ([727b92a](https://github.com/jayantrohila57/modelry/commit/727b92a010d2f1ec47f4096eede436d9290e5cef))
* introduce Modelry branding and update environment configuration ([6272942](https://github.com/jayantrohila57/modelry/commit/6272942d6a43fef2f4a92687dd35359d313f73ed))


### Bug Fixes

* correct error message variable, fix message count, wire web search toggle, improve token cache key ([58227ba](https://github.com/jayantrohila57/modelry/commit/58227bafe2885d40b2134f227f9c2fe4fc52a2ae))

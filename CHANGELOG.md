# Changelog

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

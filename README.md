<div align="center">
    <h1>Datawell Tables</h1>
</div>

<p align="center">
    <a href="https://packagist.org/packages/datawell/tables"><img src="https://img.shields.io/packagist/v/datawell/tables.svg?style=flat-square" alt="Packagist"></a>
    <a href="https://packagist.org/packages/datawell/tables"><img src="https://img.shields.io/packagist/php-v/datawell/tables.svg?style=flat-square" alt="PHP from Packagist"></a>
    <a href="https://packagist.org/packages/datawell/tables"><img src="https://badge.laravel.cloud/badge/datawell/tables?style=flat" alt="Laravel versions"></a>
    <a href="https://github.com/datawellphp/tables/actions"><img alt="GitHub Workflow Status (main)" src="https://img.shields.io/github/actions/workflow/status/datawell/tables/tests.yml?branch=main&label=Tests&style=flat-square"></a>
    <a href="https://packagist.org/packages/datawell/tables"><img src="https://img.shields.io/packagist/dt/datawell/tables.svg?style=flat-square" alt="Total Downloads"></a>
</p>

Schema-driven table UI and HTTP layer for Datawell data sources.

## Installation

You can install the package via Composer:

```bash
composer require datawell/tables
```

You may publish all of the package's resources at once:

```bash
php artisan vendor:publish --tag="tables"
```

Or, you may publish each resource individually:

### Publishing the Configuration File

```bash
php artisan vendor:publish --tag="tables-config"
```

## Usage

This package publishes a thin JSON layer over the core `Datawell\\Executor` — always on the
Direct channel, always as the authenticated user. Point `tables.routes.middleware` at
whatever authenticates people in your app.

| Method | URI | Purpose |
| --- | --- | --- |
| GET | `/datawell/sources` | Sources available to the user |
| GET | `/datawell/sources/{source}/schema` | The published contract, as this user |
| POST | `/datawell/sources/{source}/query` | Run a query (D05 wire shape in the body) |
| POST | `/datawell/sources/{source}/validate` | Dry-run validation: `{passes, errors}` |
| POST | `/datawell/sources/{source}/actions` | Execute an action (D40 wire shape) |
| GET | `/datawell/runs/{run}` | A queued run's progress / final report |
| GET | `/datawell/sources/{source}/entities/{id}` | One entity's reference |
| GET | `/datawell/sources/{source}/entities/{id}/values/{field}` | Remainder of a many-valued field |

Validation failures return `422` with `{message, errors}`; anything unknown, hidden, or
out of scope is an indistinguishable `404`.

## Changelog

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

## Contributing

Thank you for considering contributing to Datawell Tables! Please review our [contributing guide](.github/CONTRIBUTING.md) to get started.

## Security Vulnerabilities

Please review [our security policy](.github/SECURITY.md) on how to report security vulnerabilities.

## Credits

- [Ethan Barlow](https://github.com/EthanBarlo)
- [All Contributors](../../contributors)

## License

Datawell Tables is open-sourced software licensed under the [MIT license](LICENSE.md).

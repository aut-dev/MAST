# Craft base project

This repo is hooked on https://gitlab.webpuzzlers.co.uk/web-puzzlers/autonomy

PHP version is 8.1  
Uses a mariadb 10.4 database  
Uses composer version 2

# Installation

## Composer config (do only once per computer)

Update your global composer config by running the commands :

- `composer config -g repositories.puzzlers-craft composer https://gitlab.puzzlers.run/api/v4/group/7/-/packages/composer/`
- `composer config -g gitlab-token.gitlab.puzzlers.run <TOKEN>`
- `composer config -g gitlab-domains gitlab.puzzlers.run`

\<TOKEN> is your gitlab token, found on gitlab, user settings -> Access tokens -> Tick "api" scopes and create -> copy paste

That will tell composer where to look for the craft package that live on gitlab, and take care of all authentication.

## Installation

- copy .env.example into .env
- run `composer install` or `ddev composer install` if you're using ddev
- run `craft setup/app-id` or `ddev craft setup/app-id`
- run `craft setup/security-key` or `ddev craft setup/security-key`

## DDEV

This project can be run on ddev : https://ddev.readthedocs.io/en/stable/

Run `ddev start` and access website at https://autonomy.ddev.site
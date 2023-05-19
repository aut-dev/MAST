<?php

namespace themes\front\assets;

use Ryssbowh\CraftThemes\Themes;
use craft\web\AssetBundle;

abstract class WebpackAsset extends AssetBundle
{
    public $depends = [
        Index::class
    ];

    public $cssOptions = [
        'appendTimestamp' => false
    ];

    public $jsOptions = [
        'appendTimestamp' => false
    ];

    public function init()
    {
        parent::init();
        $js = Themes::$plugin->registry->current->manifest[$this->webpackName . '.js'] ?? false;
        if ($js) {
            $this->js[] = [$js, 'type' => 'module'];
        }
        $js = Themes::$plugin->registry->current->legacyManifest[$this->webpackName . '.js'] ?? false;
        if ($js) {
            $this->js[] = [$js, 'nomodule' => true];
        }
        $css = Themes::$plugin->registry->current->manifest[$this->webpackName . '.css'] ?? false;
        if ($css) {
            $this->css[] = $css;
        }
    }
}
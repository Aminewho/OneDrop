package com.music.OneDrop.Controller;
import java.io.IOException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.music.OneDrop.Dto.AppConfig;
import com.music.OneDrop.Service.ConfigService;


@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final ConfigService configService;

    public ConfigController(ConfigService configService) {
        this.configService = configService;
    }

    @GetMapping
    public AppConfig getConfig() throws IOException {
        return configService.getConfig();
    }
}
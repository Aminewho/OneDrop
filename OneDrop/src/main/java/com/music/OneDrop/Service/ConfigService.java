package com.music.OneDrop.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.music.OneDrop.Dto.AppConfig;

import jakarta.annotation.PostConstruct;







@Service
public class ConfigService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final Path CONFIG_FILE =
            Paths.get(System.getenv("LOCALAPPDATA"), "OneDrop", "config.json");

    @PostConstruct
    public void initializeConfig() {
        try {

            if (Files.exists(CONFIG_FILE)) {
                return;
            }

            Files.createDirectories(CONFIG_FILE.getParent());

            AppConfig config = new AppConfig(
                    "modern",
                    "bleu.png",
                    "OneDrop Demo"
            );

            OBJECT_MAPPER.writerWithDefaultPrettyPrinter()
                    .writeValue(CONFIG_FILE.toFile(), config);

            System.out.println("Config file created: " + CONFIG_FILE);

        } catch (Exception e) {
            throw new RuntimeException("Unable to create config.json", e);
        }
    }

    public AppConfig getConfig() throws IOException {
        return OBJECT_MAPPER.readValue(
                CONFIG_FILE.toFile(),
                AppConfig.class
        );
    }
}
/*package com.music.OneDrop.Config;


import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // 🛑 Remplacez http://localhost:5000 par l'URL exacte de votre front-end
        registry.addMapping("/**") // Applique la règle à toutes les routes (ex: /api/audio/**)
            .allowedOrigins("http://localhost:5000") // 🛑 L'ORIGINE DE VOTRE FRONT-END
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Autorise les méthodes HTTP nécessaires
            .allowedHeaders("*") // Autorise tous les headers
            .allowCredentials(true); // Si vous utilisez des cookies ou des sessions
    }
}*/
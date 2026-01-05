{
    "config_version": "1.0",
    "on_start_config": null,
    "on_end_config": null,
    "tool_runner_parameters": {
        "parameters": {}
    },
    "privacy_config": {
        "header": {
            "version": "1.0",
            "timestamp": "2026-01-05 11:51:38 +5:30"
        },
        "agent_variable_config": null,
        "user_information_config": {
            "phone_number": {
                "mask_config": {
                    "privacy_strategy": "mask",
                    "pattern": "(\\d{6})(\\d{4})",
                    "replacement": "******\\2"
                },
                "hash_config": {
                    "privacy_strategy": "hash",
                    "salt": null,
                    "hash_algorithm": "sha256"
                },
                "encrypt_config": null
            },
            "email": {
                "mask_config": {
                    "privacy_strategy": "mask",
                    "pattern": "(\\w{3})\\w*@(\\w{3})\\w*(\\.\\w{2,})",
                    "replacement": "\\1***@\\2***\\3"
                },
                "hash_config": {
                    "privacy_strategy": "hash",
                    "salt": null,
                    "hash_algorithm": "sha256"
                },
                "encrypt_config": null
            }
        }
    },
    "memory_config": null,
    "channel_type": "v2v",
    "llm_config": {
        "config_version": "1.0",
        "llm_model_variant": "yotta/llama-3.1-70b",
        "tool_llm_model_variant": "yotta/llama-3.1-70b",
        "temperature": 0.1,
        "agent_config": {
            "global_prompt": null,
            "response_style": "",
            "global_context": null,
            "global_tool_names": [],
            "system_prompt_role": "system",
            "system_prompt_template": "",
            "agent_variables": {},
            "internal_variables": {},
            "kb_config": {},
            "states": {
                "start": {
                    "name": "start",
                    "goal": "",
                    "instructions": "If User says \"Hello\" just say you got Rick Rolled",
                    "context": null,
                    "tool_names": [],
                    "next_states": [],
                    "agent_variables_in_context": []
                }
            },
            "initial_state_name": "start",
            "enable_structured_prompt": false,
            "enable_lid": false,
            "enable_voicemail_detection": false,
            "send_multiple_messages": false,
            "supported_languages": [
                "Hindi"
            ],
            "thread_window": null,
            "structured_content_thread_window": null,
            "tool_calls_thread_window": null,
            "token_based_truncation": true,
            "agent_can_end_interaction": true,
            "is_single_prompt_mode": true,
            "translate_language": null,
            "memory_context": null
        },
        "fallback_messages": [
            "Sorry, I could not understand. Can you please repeat?"
        ]
    },
    "intro_message_config": {
        "config_version": "1.0",
        "audio": "Hello, this is Neha. How can I help you today?",
        "multilingual_audio": null,
        "pre_recorded_audio_message": null
    },
    "language_config": {
        "config_version": "1.0",
        "initial_language_name": "Hindi",
        "supported_languages": [
            "Hindi"
        ],
        "enable_language_identification": false,
        "indic_language_style": "classic_colloquial_with_custom_code_mixed_words",
        "numbers_in_indic": false,
        "custom_code_mixed_words": [],
        "language_identification": null
    },
    "speech_to_text_config": {
        "config_version": "1.0",
        "asr_model_name": null,
        "speech_hotwords": [],
        "system_prompt": null
    },
    "text_to_speech_config": {
        "config_version": "1.0",
        "speaker_id": "neha",
        "language_speaker_mapping": {
            "hi-IN": "neha",
            "bn-IN": "neha",
            "gu-IN": "neha",
            "kn-IN": "neha",
            "ml-IN": "neha",
            "mr-IN": "neha",
            "od-IN": "neha",
            "pa-IN": "neha",
            "ta-IN": "neha",
            "te-IN": "neha",
            "en-US": "neha"
        },
        "language_voice_settings_mapping": {
            "hi-IN": {
                "src_speaker": "hi-f-int",
                "tgt_speaker": "hi-f-int",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "bn-IN": {
                "src_speaker": "bn-f-indictts",
                "tgt_speaker": "bn-f-indictts",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "gu-IN": {
                "src_speaker": "gu-f-indictts",
                "tgt_speaker": "bn-f-indictts",
                "pitch": 0.6,
                "pace": 1.05,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "kn-IN": {
                "src_speaker": "kn-f-ai4b",
                "tgt_speaker": "kn-f-limmits",
                "pitch": 0.2,
                "pace": 1.05,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "ml-IN": {
                "src_speaker": "ml-f-ai4b",
                "tgt_speaker": "ml-f-ai4b",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "mr-IN": {
                "src_speaker": "mr-f-limmits",
                "tgt_speaker": "hi-f-int",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "od-IN": {
                "src_speaker": "od-f-indictts",
                "tgt_speaker": "hi-f-int",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "pa-IN": {
                "src_speaker": "pa-f-indictts",
                "tgt_speaker": "pa-f-indictts",
                "pitch": 0,
                "pace": 1.2,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "ta-IN": {
                "src_speaker": "ta-f-ai4b",
                "tgt_speaker": "kn-f-ai4b",
                "pitch": 0,
                "pace": 0.9,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "te-IN": {
                "src_speaker": "te-f-indictts",
                "tgt_speaker": "te-f-indictts",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            },
            "en-US": {
                "src_speaker": "en-f-limmits_xlit_en",
                "tgt_speaker": "hi-f-int",
                "pitch": 0,
                "pace": 1,
                "volume": 1,
                "tts_model_name": "sarvam-tts",
                "stability": null,
                "similarity_boost": null,
                "use_speaker_boost": false,
                "emotion": null,
                "style": 0.5,
                "speed": 1,
                "bypass_translate_transliterate": false,
                "preprocessing_mode": "transliterate"
            }
        },
        "language_gender_settings_mapping": {
            "hi-IN": "Female",
            "bn-IN": "Female",
            "kn-IN": "Female",
            "ml-IN": "Female",
            "mr-IN": "Female",
            "od-IN": "Female",
            "pa-IN": "Female",
            "ta-IN": "Female",
            "te-IN": "Female",
            "gu-IN": "Female",
            "en-US": "Female"
        },
        "language_prompt_mapping": {
            "en-US": "Hello, today we will be talking in English.",
            "hi-IN": "नमस्ते, आज हम Hindi और English दोनों में बात करेंगे, ठीक है?",
            "ta-IN": "வணக்கம், இன்று நாம் தமிழில் பேசுவோம்."
        },
        "speaker_provider": "sarvam",
        "speech_settings": {
            "pitch": null,
            "pace": null,
            "volume": null
        },
        "enable_mixed_speaker_settings": false,
        "mixed_speaker_config": [],
        "silence_duration": 300
    },
    "interaction_config": {
        "allow_interrupt_during_playback": false,
        "vad_config": {
            "config_version": "1.0",
            "primary_vad": "basic-vad",
            "probability_modulator_config": null,
            "speech_frame_config": null
        },
        "nudge_config": null,
        "config_version": "1.0",
        "max_interaction_time_seconds": null,
        "skip_translate_transliterate": false,
        "send_whatsapp_message_on_end": false,
        "whatsapp_on_end_mode": null
    },
    "guardrail_config": {
        "config_version": "1.0"
    },
    "output_config": {
        "config_version": "1.0",
        "output_type": "audio",
        "background_sound": {
            "enabled": false,
            "noise_type": "quiet_office",
            "volume_dbfs": -40
        }
    },
    "org_id": "sarvamai",
    "workspace_id": "default",
    "app_id": "Scenario-Cr-ec91a1b0-1649",
    "app_name": "Scenario Creation Agent",
    "app_version": 1,
    "app_version_description": null,
    "created_by": "vishalm@sarvam.ai",
    "updated_by": "vishalm@sarvam.ai",
    "created_at": "2026-01-05T11:50:03.041057Z",
    "updated_at": "2026-01-05T11:50:40.342212Z",
    "status": "draft",
    "channel_provider": "default",
    "is_deployed": false,
    "is_single_prompt_mode": true,
    "generated_suggestions": {},
    "revision_count": 0
}
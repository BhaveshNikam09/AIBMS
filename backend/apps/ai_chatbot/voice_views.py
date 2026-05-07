from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from utils.response import error_response, success_response

from .voice_services import handle_voice_assistant_request

logger = logging.getLogger(__name__)


class VoiceAssistantView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        try:
            data = request.data or {}
            mode = str(data.get("mode") or "command").strip().lower()
            business_id = str(data.get("business_id") or "").strip() or None
            session_id = str(data.get("session_id") or "").strip() or None
            voice_id = str(data.get("voice_id") or data.get("voiceId") or getattr(settings, "MURF_VOICE_ID", "Anisha")).strip()
            voice_style = str(data.get("voice_style") or data.get("style") or getattr(settings, "MURF_VOICE_STYLE", "Conversation")).strip()
            voice_model = str(data.get("voice_model") or data.get("model") or getattr(settings, "MURF_VOICE_MODEL", "FALCON")).strip().upper()
            text = str(data.get("text") or data.get("message") or "").strip()
            audio_file = request.FILES.get("audio") or request.FILES.get("file")

            if mode != "briefing" and not text and audio_file is None:
                return error_response(
                    message="Please provide text or audio for the voice assistant.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            payload = handle_voice_assistant_request(
                user=request.user,
                business_id=business_id,
                session_id=session_id,
                mode=mode,
                text=text,
                audio_file=audio_file,
                voice_id=voice_id,
                voice_style=voice_style,
                voice_model=voice_model,
                request=request,
            )
            return success_response(
                data=payload,
                message="Voice request processed successfully.",
            )
        except ValueError as exc:
            return error_response(
                message=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error("Voice assistant error: %s", exc, exc_info=True)
            return error_response(
                message="Failed to process the voice request. Please try again.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

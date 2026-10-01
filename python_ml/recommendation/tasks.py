from recommendation.celery_app import app


@app.task(bind=True)
def run_suggestions(self):
    from recommendation.run_user_suggestions import main
    return main()


@app.task(bind=True)
def run_explore(self):
    from recommendation.run_explore import main
    return main()
